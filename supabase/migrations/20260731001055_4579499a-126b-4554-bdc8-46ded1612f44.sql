create policy "own files read" on storage.objects for select
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own files write" on storage.objects for insert
  with check (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own files update" on storage.objects for update
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);