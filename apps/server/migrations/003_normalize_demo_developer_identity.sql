UPDATE users
SET name='Ankita Sharma', email='ankita@velozity.test'
WHERE email='noah@velozity.test'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email='ankita@velozity.test');
