-- Create storage bucket for PDF documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    52428800, -- 50MB limit
    ARRAY['application/pdf']::text[]
);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload documents to their organization folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents' AND
        auth.uid() IS NOT NULL AND
        (storage.foldername(name))[1] IN (
            SELECT organization_id::text 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view documents in their organization folder" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents' AND
        auth.uid() IS NOT NULL AND
        (storage.foldername(name))[1] IN (
            SELECT organization_id::text 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete documents in their organization folder" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documents' AND
        auth.uid() IS NOT NULL AND
        (storage.foldername(name))[1] IN (
            SELECT organization_id::text 
            FROM profiles 
            WHERE id = auth.uid()
        )
    );