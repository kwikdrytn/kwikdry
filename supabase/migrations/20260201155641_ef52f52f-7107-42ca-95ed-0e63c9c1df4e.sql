-- Add unique constraints for HCP upsert operations

-- hcp_jobs unique constraint on organization_id + hcp_job_id
ALTER TABLE hcp_jobs
ADD CONSTRAINT hcp_jobs_org_hcp_id_unique UNIQUE (organization_id, hcp_job_id);

-- hcp_customers unique constraint on organization_id + hcp_customer_id  
ALTER TABLE hcp_customers
ADD CONSTRAINT hcp_customers_org_hcp_id_unique UNIQUE (organization_id, hcp_customer_id);

-- hcp_employees unique constraint on organization_id + hcp_employee_id
ALTER TABLE hcp_employees
ADD CONSTRAINT hcp_employees_org_hcp_id_unique UNIQUE (organization_id, hcp_employee_id);

-- hcp_service_zones unique constraint on organization_id + hcp_zone_id
ALTER TABLE hcp_service_zones
ADD CONSTRAINT hcp_service_zones_org_hcp_id_unique UNIQUE (organization_id, hcp_zone_id);