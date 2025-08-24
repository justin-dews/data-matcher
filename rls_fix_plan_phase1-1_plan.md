⏺ Phase 1.1 Implementation Plan: Complete Table-by-Table RLS Audit

  Objective

  Conduct a comprehensive audit of all 10 core tables to document current RLS status, identify issues, and establish baseline for fixes.

  Approach

  Create SQL scripts to systematically examine each table's:
  - Column structure (especially organization_id presence)
  - RLS enablement status
  - Existing policies and their logic
  - Foreign key constraints
  - Data distribution across organizations

  Implementation Plan

  Step 1: Create RLS Audit SQL Script

  I'll create a comprehensive SQL script that automatically checks all tables and generates a detailed report of:
  - RLS enabled/disabled status
  - Existing policies (names, definitions, roles)
  - Column presence (organization_id, foreign keys)
  - Data counts per organization
  - Constraint validation

  Step 2: Execute Table-by-Table Audit

  Run the audit script and document findings for each of the 10 tables:
  1. organizations (base tenant table)
  2. profiles (user accounts)
  3. products (92 records - currently inaccessible via API)
  4. documents (uploaded PDFs)
  5. line_items (parsed document data)
  6. matches (matching decisions)
  7. competitor_aliases (learned mappings)
  8. product_embeddings (vector data)
  9. activity_log (audit trail)
  10. settings (org configurations)

  Step 3: Create Findings Report

  Generate a structured report documenting:
  - Current State: What's working/broken for each table
  - Gap Analysis: Missing policies, incorrect configurations
  - Data Issues: Organization assignment problems
  - Priority Issues: Critical blockers (like products table access)