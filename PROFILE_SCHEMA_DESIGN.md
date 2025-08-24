# User Profile Schema Design

Based on requirements discussion, here's the proper profile system design:

## **User Flow**
1. **Admin Invitation**: Admin enters email + organization → creates invitation record
2. **User Signup**: User receives email, signs up through Supabase Auth
3. **Profile Auto-Creation**: On first login, basic profile created with invitation data
4. **Profile Completion**: User prompted to fill in required fields (full_name, etc.)

## **Required Database Changes**

### **1. User Invitations Table**
```sql
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invited_by UUID NOT NULL REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending',
  
  UNIQUE(email, organization_id)
);
```

### **2. Updated Profiles Table**
```sql
-- Add missing fields to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Update role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user'));

-- Make full_name required (after user completes profile)
-- We'll handle this in application logic, not database constraint
```

### **3. RLS Policies**
```sql
-- Invitations table policies
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations in their organization" ON user_invitations
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage invitations" ON user_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND organization_id = user_invitations.organization_id 
      AND role = 'admin'
    )
  );
```

## **Implementation Plan**

### **Phase 1: Database Schema (Immediate)**
- Create user_invitations table
- Update profiles table with new fields
- Add proper RLS policies
- Fix current profile creation for existing user

### **Phase 2: Invitation System**
- Admin UI for sending invitations
- Email templates for invitations
- Invitation acceptance flow

### **Phase 3: Profile Completion**
- Detect incomplete profiles on login
- Profile completion modal/page
- Validation for required fields

## **Current Issue Fix**

For the immediate 500 error, we need to:
1. Ensure your existing profile exists and is properly set up
2. Fix any remaining RLS policy issues
3. Handle the profile completion state in the frontend

## **Required Fields Summary**
- **Always Required**: `id`, `organization_id`, `email`, `role`
- **Required After Completion**: `full_name`
- **Optional**: All other fields

This design supports your invitation-only flow while allowing flexible profile completion.