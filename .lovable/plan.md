

# Plan: Fix Services Not Flowing to HouseCall Pro with Prices

## Problem Summary

When creating jobs from the ModifySuggestionDialog, services are not being added to HouseCall Pro jobs with their prices. The HCP API rejects the line items with the error `{"errors":{"name":"is missing"}}`.

## Root Causes Identified

### Issue 1: Invalid Service IDs in Database
The `hcp_services` table contains placeholder IDs like `service-0`, `service-1`, etc. instead of real HCP API IDs (which look like `svc_abc123...`). The sync function appears to be using array indices instead of actual service IDs from the HCP API response.

### Issue 2: Missing Required `name` Field
When calling `POST /jobs/{job_id}/line_items`, the HCP API requires a `name` field even when providing a `service_item_id`. The current code only sends:
```json
{ "service_item_id": "service-21", "quantity": 1 }
```
But it needs:
```json
{ "service_item_id": "svc_real_id", "name": "Service Name", "quantity": 1 }
```

### Issue 3: Fallback Logic Hits Rate Limits
When the service_item_id approach fails, the fallback to name-based and individual additions is hitting HCP rate limits.

---

## Solution

### Part 1: Update Edge Function `create-hcp-job/index.ts`

**Always include the `name` field when adding line items:**

```typescript
// When building lineItemsToAdd, always include the name
lineItemsToAdd.push({
  service_item_id: serviceData.hcp_service_id,
  name: serviceData.name,  // ← Add this
  quantity: 1,
});
```

**Specific changes:**
1. Lines 416-423: When adding from pricebook_mapping, include the name
2. Lines 433-439: When adding from hcp_services, include the service name  
3. Lines 451-458: When adding from partial match, include the matched name
4. Add rate limit handling with delays between line item additions

### Part 2: Update Sync Function `sync-hcp-data/index.ts`

**Fix the service ID extraction to use real HCP IDs:**

The current code on lines 512-529 tries to get the ID from `item.id`, but if the HCP API returns the service ID in a different field (like `service_id` or `item_id`), and if these are missing, it's generating placeholder IDs.

**Add debug logging to identify the actual API response structure:**
```typescript
console.log('Full service item:', JSON.stringify(item));
```

**Verify the ID field is being extracted correctly from the HCP price_book/services response.**

---

## Technical Changes

### File 1: `supabase/functions/create-hcp-job/index.ts`

**Update line items building logic (around lines 406-462):**

```typescript
// Look up each service in hcp_services table
for (const serviceName of serviceNames) {
  // First check pricebook_mapping for this service
  const { data: mapping } = await supabase
    .from("pricebook_mapping")
    .select("hcp_pricebook_item_id, hcp_pricebook_item_name")
    .eq("organization_id", organizationId)
    .ilike("service_type", serviceName)
    .maybeSingle();

  if (mapping?.hcp_pricebook_item_id) {
    lineItemsToAdd.push({
      service_item_id: mapping.hcp_pricebook_item_id,
      name: mapping.hcp_pricebook_item_name || serviceName,  // ← Always include name
      quantity: 1,
    });
    continue;
  }

  // Then check hcp_services table
  const { data: serviceData } = await supabase
    .from("hcp_services")
    .select("hcp_service_id, name, price")
    .eq("organization_id", organizationId)
    .ilike("name", serviceName)
    .maybeSingle();

  if (serviceData?.hcp_service_id) {
    lineItemsToAdd.push({
      service_item_id: serviceData.hcp_service_id,
      name: serviceData.name,  // ← Always include name
      quantity: 1,
    });
    continue;
  }

  // Partial match fallback
  const { data: partialMatch } = await supabase
    .from("hcp_services")
    .select("hcp_service_id, name, price")
    .eq("organization_id", organizationId)
    .ilike("name", `%${serviceName}%`)
    .limit(1)
    .maybeSingle();

  if (partialMatch?.hcp_service_id) {
    lineItemsToAdd.push({
      service_item_id: partialMatch.hcp_service_id,
      name: partialMatch.name,  // ← Always include name
      quantity: 1,
    });
    continue;
  }

  // Ultimate fallback: Add as custom line item by name only
  console.warn(`No HCP service ID found for "${serviceName}", adding by name only`);
  lineItemsToAdd.push({
    name: serviceName,
    description: serviceName,
    quantity: 1,
  });
}
```

**Update the line item type definition (around line 398):**

```typescript
const lineItemsToAdd: Array<{
  service_item_id?: string;
  name: string;  // ← Make name required
  description?: string;
  quantity: number;
  unit_price?: number;
}> = [];
```

### File 2: `supabase/functions/sync-hcp-data/index.ts`

**Add enhanced logging to debug the service ID issue (around line 508):**

```typescript
// Log the full structure of the first service item to understand the API response
if (page === 1 && items.length > 0) {
  console.log('Full first service item structure:', JSON.stringify(items[0], null, 2));
  console.log('Service ID fields available:', {
    id: items[0].id,
    service_id: items[0].service_id,
    item_id: items[0].item_id,
    pricebook_item_id: items[0].pricebook_item_id,
  });
}
```

**Consider generating placeholder IDs only if real IDs are missing, with a different prefix:**
```typescript
// Only use placeholder if absolutely no ID is available
const serviceId = item.id || item.service_id || item.item_id || 
                  item.pricebook_item_id || `local-${idx}`;
```

---

## Data Flow Summary (After Fix)

```text
User selects services in ModifySuggestionDialog
       ↓
Services saved as selectedServices[] state
       ↓
On confirm: serviceType = selectedServices.join(", ")
       ↓
BookingSuggestionPanel calls create-hcp-job edge function
       ↓
Edge function splits serviceType by comma
       ↓
For each service name:
  1. Look up in pricebook_mapping → get ID + name
  2. Fall back to hcp_services → get ID + name  
  3. Fall back to partial match → get ID + name
  4. Ultimate fallback → add by name only (custom line item)
       ↓
POST /jobs/{id}/line_items with { service_item_id, name, quantity }
       ↓
HCP accepts line items and applies pricing from their price book
```

---

## Testing Plan

1. Re-sync HCP data to refresh services (Settings → Integration Settings → Sync)
2. Check edge function logs to verify actual service IDs from HCP API
3. Test creating a job with 1 service selected → verify line item appears in HCP with price
4. Test creating a job with multiple services → verify all line items appear
5. Test the modify dialog → select different services → confirm they flow through

---

## Notes

- The `pricebook_mapping` table is currently empty, so the code will rely on `hcp_services` lookup
- If the HCP API is returning services without real IDs, we may need to investigate the API response format further
- The fix ensures that even if service_item_id lookup fails, jobs can still be created with named line items

