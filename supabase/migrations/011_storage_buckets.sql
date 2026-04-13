-- Migration 011: Create storage buckets

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',           'avatars',           true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('logos',             'logos',             true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('medical-documents', 'medical-documents', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('org-assets',        'org-assets',        true,  10485760, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies

-- avatars: anyone can view, authenticated users can upload their own
CREATE POLICY "avatars_public_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_insert"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "avatars_owner_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);
CREATE POLICY "avatars_owner_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);

-- logos: public read, authenticated upload
CREATE POLICY "logos_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "logos_auth_insert"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "logos_auth_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "logos_auth_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- medical-documents: only authenticated users can access their org's docs
CREATE POLICY "docs_auth_select" ON storage.objects FOR SELECT USING (bucket_id = 'medical-documents' AND auth.role() = 'authenticated');
CREATE POLICY "docs_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'medical-documents' AND auth.role() = 'authenticated');
CREATE POLICY "docs_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'medical-documents' AND auth.role() = 'authenticated');

-- org-assets: public read, authenticated upload
CREATE POLICY "org_assets_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'org-assets');
CREATE POLICY "org_assets_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'org-assets' AND auth.role() = 'authenticated');
CREATE POLICY "org_assets_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'org-assets' AND auth.role() = 'authenticated');
