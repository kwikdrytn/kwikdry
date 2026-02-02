-- Delete old fake service IDs that have "service-X" format
-- Keep only the real HCP service IDs that start with "olit_" or other real formats
DELETE FROM hcp_services 
WHERE hcp_service_id LIKE 'service-%';