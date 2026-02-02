# Plan: HCP Services Flow - COMPLETED ✓

## Summary

Fixed services not flowing to HouseCall Pro with prices by:

1. **Always including `name` field** in line item requests (HCP API requires it)
2. **Added fallback to custom line items** when no matching service ID found
3. **Enhanced logging** in sync function to debug ID extraction

## Changes Made

### `create-hcp-job/index.ts`
- Made `name` required in `lineItemsToAdd` type definition
- Added `name` field to all line item additions (pricebook mapping, hcp_services, partial match)
- Added custom line item fallback when no service ID is found

### `sync-hcp-data/index.ts`
- Added detailed logging of first service item structure
- Added per-service logging during sync for debugging

## Testing

1. Re-sync HCP data from Settings → Integration Settings
2. Create a job with services selected
3. Check edge function logs to verify line items are added with names
4. Verify services appear in HCP with pricing

