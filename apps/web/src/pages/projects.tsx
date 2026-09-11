import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, Pencil, Trash2, Building2 } from 'lucide-react';
import type { Project } from '@velozity/shared';
import { api, json } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ProjectCard } from './dashboard';
import { TaskList } from './tasks';
import { ActivityFeed } from '../components/activity';
import { ProjectForm } from '../components/forms';
import { Empty, ErrorNotice, Loading, Modal } from '../components/ui';
export function Projects() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const items =
    query.data?.filter((p) =>
      `${p.name} ${p.client_name}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FROM BRIEF TO DELIVERY</span>
          <h1>Projects</h1>
          <p>A home for every idea your team is bringing to life.</p>
        </div>
        {user?.role !== 'DEVELOPER' && (
          <button className="button primary" onClick={() => setParams({ new: '1' })}>
            <Plus size={17} />
            Create project
          </button>
        )}
      </div>
      <div className="page-toolbar">
        <span>{query.data?.length ?? 0} projects in your workspace</span>
        <input
          aria-label="Search projects"
          placeholder="Find a project or client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : items.length ? (
        <div className="all-projects-grid">
          {items.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      ) : (
        <Empty
          title="Room for your next big idea"
          description="Create a project or try another search."
        />
      )}
      {params.get('new') && user?.role !== 'DEVELOPER' && (
        <ProjectForm onClose={() => setParams({})} />
      )}
    </>
  );
}
export function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api<Project>(`/projects/${id}`),
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${id}`, json('DELETE')),
    onSuccess: () => {
      void cache.invalidateQueries();
    },
  });
  if (remove.isSuccess)
    return (
      <Empty
        title="Project deleted"
        description="The project and its tasks have been removed."
        action={
          <Link className="button" to="/projects">
            Back to projects
          </Link>
        }
      />
    );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={15} />
        All projects
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Building2 size={13} />
            {query.data.client_name}
          </span>
          <h1>{query.data.name}</h1>
          <p>{query.data.description}</p>
        </div>
        {user?.role !== 'DEVELOPER' && (
          <div className="inline-actions">
            <button className="button" onClick={() => setEdit(true)}>
              <Pencil size={15} />
              Edit project
            </button>
            <button
              className="icon-button danger"
              aria-label="Delete project"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>
      <TaskList projectId={id} embedded />
      <section className="panel project-activity">
        <div className="section-heading">
          <h2>Project activity</h2>
        </div>
        <ActivityFeed projectId={id} />
      </section>
      {edit && <ProjectForm project={query.data} onClose={() => setEdit(false)} />}{' '}
      {deleting && (
        <Modal title="Delete this project?" onClose={() => setDeleting(false)}>
          <p className="modal-intro">
            This removes “{query.data.name}”, its tasks, activity, and related notifications. This
            cannot be undone.
          </p>
          {remove.error && <ErrorNotice error={remove.error} />}
          <div className="form-actions">
            <button className="button" onClick={() => setDeleting(false)}>
              Keep project
            </button>
            <button
              className="button destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
