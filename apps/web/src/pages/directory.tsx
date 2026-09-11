import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Building2, UserRoundX, UserRoundCheck, Trash2 } from 'lucide-react';
import { labels, type User, type Client } from '@velozity/shared';
import { api, json } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ClientForm, UserForm } from '../components/forms';
import { Avatar, Empty, ErrorNotice, Loading, Modal } from '../components/ui';
export function Directory({ kind }: { kind: 'clients' | 'users' }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<User | Client | null>(null);
  const [confirm, setConfirm] = useState<User | Client | null>(null);
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: [kind], queryFn: () => api<(User | Client)[]>(`/${kind}`) });
  const records =
    query.data?.filter((record) => {
      if (kind !== 'clients' || !search.trim()) return true;
      const client = record as Client;
      return `${client.name} ${client.email} ${client.company}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    }) ?? [];
  const change = useMutation({
    mutationFn: (record: User | Client) =>
      api(
        `/${kind}/${record.id}`,
        kind === 'users'
          ? json('PATCH', { is_active: !(record as User).is_active })
          : json('DELETE'),
      ),
    onSuccess: () => {
      void cache.invalidateQueries();
      setConfirm(null);
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {kind === 'clients' ? 'THE PEOPLE WE BUILD FOR' : 'GREAT WORK STARTS WITH PEOPLE'}
          </span>
          <h1>{kind === 'clients' ? 'Clients' : 'Team members'}</h1>
          <p>
            {kind === 'clients'
              ? 'Keep every client relationship close to the work.'
              : 'A shared space for the people making it happen.'}
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={17} />
            {kind === 'clients' ? 'Add client' : 'Add member'}
          </button>
        )}
      </div>
      {kind === 'clients' && (
        <div className="page-toolbar client-toolbar">
          <span>{query.data?.length ?? 0} clients in your workspace</span>
          <input
            aria-label="Search clients"
            placeholder="Find a client, email, or company…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}
      <section className="panel">
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorNotice error={query.error} />
        ) : !query.data.length ? (
          <Empty
            title="Let’s make a connection"
            description="Add the first entry to get started."
          />
        ) : !records.length ? (
          <Empty
            title="No matching clients"
            description="Try a different name, email, or company search."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{kind === 'clients' ? 'Client' : 'Team member'}</th>
                  <th>Email</th>
                  <th>{kind === 'clients' ? 'Company' : 'Role'}</th>
                  {kind === 'users' && <th>Status</th>}
                  {user?.role === 'ADMIN' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="assignee-cell">
                        {kind === 'users' ? (
                          <Avatar name={record.name} />
                        ) : (
                          <span className="client-symbol">
                            <Building2 size={18} />
                          </span>
                        )}
                        <strong>{record.name}</strong>
                      </span>
                    </td>
                    <td>{record.email}</td>
                    <td>{'role' in record ? labels[record.role] : record.company}</td>
                    {'role' in record && (
                      <td>
                        <span className={`badge ${record.is_active ? 'done' : 'todo'}`}>
                          {record.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    )}
                    {user?.role === 'ADMIN' && (
                      <td>
                        <div className="inline-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${record.name}`}
                            onClick={() => setEdit(record)}
                          >
                            <Pencil size={16} />
                          </button>
                          {record.id !== user?.id && (
                            <button
                              className="icon-button"
                              aria-label={`${kind === 'clients' ? 'Delete' : (record as User).is_active ? 'Deactivate' : 'Reactivate'} ${record.name}`}
                              onClick={() => setConfirm(record)}
                            >
                              {kind === 'clients' ? (
                                <Trash2 size={16} />
                              ) : (record as User).is_active ? (
                                <UserRoundX size={16} />
                              ) : (
                                <UserRoundCheck size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {(adding || edit) &&
        (kind === 'clients' ? (
          <ClientForm
            client={(edit as Client) ?? undefined}
            onClose={() => {
              setAdding(false);
              setEdit(null);
            }}
          />
        ) : (
          <UserForm
            user={(edit as User) ?? undefined}
            onClose={() => {
              setAdding(false);
              setEdit(null);
            }}
          />
        ))}
      {confirm && (
        <Modal
          title={
            kind === 'clients'
              ? 'Delete client?'
              : (confirm as User).is_active
                ? `Deactivate ${(confirm as User).name}?`
                : 'Reactivate member?'
          }
          onClose={() => setConfirm(null)}
        >
          <p className="modal-intro">
            {kind === 'clients'
              ? `Remove ${confirm.name}? Clients with projects must have their projects reassigned or deleted first.`
              : (confirm as User).is_active
                ? `${confirm.name} will no longer be able to sign in. Existing task and activity history will remain.`
                : `Restore workspace access for ${confirm.name}.`}
          </p>
          {change.error && <ErrorNotice error={change.error} />}
          <div className="form-actions">
            <button className="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={change.isPending}
              onClick={() => change.mutate(confirm)}
            >
              {change.isPending
                ? 'Saving…'
                : kind === 'users' && (confirm as User).is_active
                  ? 'Deactivate'
                  : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
