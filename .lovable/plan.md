

## Merge PriceBook Mapping into Integration Settings

The PriceBook Mapping page will be folded into the existing HouseCall Pro section on the Integration Settings page as a collapsible section. The standalone page and its route will be removed, but all the backend logic (used by AI Scheduling and Job Creation) stays untouched.

### What stays the same
- The `pricebook_mapping` database table and all RLS policies
- The `getPriceBookMapping` / `getPriceBookMappings` functions in `src/services/housecallpro.ts`
- The `PriceBookMapping` type in `src/types/scheduling.ts`
- The `create-hcp-job` edge function's PriceBook lookup logic
- The `createJobFromSuggestion` function that reads mappings for duration

### Changes

**1. Move PriceBook Mapping UI into IntegrationSettings.tsx**
- Add a new "Service Mappings" section inside the HouseCall Pro card (after the Employee Linking section)
- Use a `Collapsible` component so it doesn't clutter the page by default
- Include the same table with service type dropdowns, duration selectors, and save buttons from the current PriceBook page
- Only show this section when HCP is connected (API key is configured)

**2. Remove the standalone PriceBook Mapping page**
- Delete `src/pages/admin/PriceBookMapping.tsx`
- Remove the `/settings/pricebook` route and its legacy redirect from `src/App.tsx`
- Remove the `PriceBookMapping` import from `App.tsx`

**3. Update Settings page admin links**
- Remove the "PriceBook Mapping" entry from the `adminLinks` array in `src/pages/Settings.tsx`
- Remove the unused `BookOpen` icon import

### Technical Details

The Integration Settings page (`src/pages/admin/IntegrationSettings.tsx`) will gain:
- New state variables for PriceBook mappings (same as current `PriceBookMapping` page)
- Two new queries: existing mappings and HCP services (from `hcp_services` table)
- A save mutation using `supabase.from("pricebook_mapping").upsert()`
- A collapsible section rendered after the `<EmployeeLinking />` component with the mapping table

The section will have a header like "Service Mappings" with a count badge showing mapped/total, and will expand to show the same table UI currently on the standalone page (service type, HCP PriceBook item dropdown, default duration, status badge, save button).

Files modified:
- `src/pages/admin/IntegrationSettings.tsx` -- add PriceBook mapping section
- `src/App.tsx` -- remove route and import
- `src/pages/Settings.tsx` -- remove admin link

Files deleted:
- `src/pages/admin/PriceBookMapping.tsx`

