#!/bin/bash

# Deploy Edge Function to hosted Supabase project
# Make sure you have Supabase CLI installed and authenticated

echo "Deploying parse-pdf Edge Function..."

# Deploy the specific function
supabase functions deploy parse-pdf --project-ref theattidfeqxyaexiqwj

echo "Deployment complete!"
echo "Function URL: https://theattidfeqxyaexiqwj.supabase.co/functions/v1/parse-pdf"