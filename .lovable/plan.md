

# Plan: Fix Technician Auto-Fill in ModifySuggestionDialog

## Problem Summary

When clicking "Modify" on an AI suggestion, the "Assign To" technician dropdown shows blank instead of pre-filling with the suggested technician. The job data should be properly pulled from the ModifySuggestionDialog form fields.

## Root Cause Analysis

The matching logic in `ModifySuggestionDialog.tsx` fails to find the technician because:

1. **ID Matching Issue**: The `suggestion.technicianId` may be `undefined` if the name lookup failed in `BookingSuggestionPanel.tsx` (line 233)
2. **Name Matching Issue**: The comparison `techName === suggestionTechName` only works if names are exactly equal (after lowercase/trim), but the AI might return names with slight variations (e.g., "John Smith" vs "john smith" vs "John  Smith")
3. **Fallback Issue**: If `technicianName` is "Unassigned", neither matching branch works

## Solution

### 1. Improve Matching Logic in ModifySuggestionDialog

Update the `useEffect` to use more robust matching:
- First try exact ID match
- Then try flexible name matching (normalize whitespace, handle partial matches)
- Add console logging to help debug matching failures

### 2. Ensure Technician ID is Always Resolved

In `BookingSuggestionPanel.tsx`, enhance the technician ID resolution to be more robust by also checking partial name matches when the exact normalized name doesn't find a match.

---

## Technical Details

### File Changes

#### 1. `src/components/job-map/ModifySuggestionDialog.tsx`

**Update the useEffect matching logic (lines 67-93):**

```typescript
useEffect(() => {
  if (open && suggestion) {
    // Debug logging to trace matching issues
    console.log('[ModifyDialog] Matching technician:', {
      suggestionTechName: suggestion.technicianName,
      suggestionTechId: suggestion.technicianId,
      availableTechs: technicians.map(t => ({ 
        name: t.name, 
        hcpEmployeeId: t.hcpEmployeeId 
      }))
    });

    // Find matching technician with flexible matching
    const matchingTech = technicians.find(t => {
      // Get HCP ID from technician (could be in different properties)
      const techHcpId = t.hcpEmployeeId || (t as any).id;
      
      // Normalize names for comparison (lowercase, trim, collapse whitespace)
      const normalizeName = (name: string | undefined | null) => 
        (name || "").toLowerCase().trim().replace(/\s+/g, ' ');
      
      const suggestionTechName = normalizeName(suggestion.technicianName);
      const techName = normalizeName(t.name);
      
      // Skip if suggestion has no technician assigned
      if (!suggestionTechName || suggestionTechName === 'unassigned') {
        return false;
      }
      
      // Match by HCP ID first (most reliable)
      if (techHcpId && suggestion.technicianId && techHcpId === suggestion.technicianId) {
        return true;
      }
      
      // Match by exact name (case-insensitive, whitespace-normalized)
      if (techName && suggestionTechName && techName === suggestionTechName) {
        return true;
      }
      
      // Match by name containment (for partial matches like "John" vs "John Smith")
      if (techName && suggestionTechName) {
        if (techName.includes(suggestionTechName) || suggestionTechName.includes(techName)) {
          return true;
        }
      }
      
      return false;
    });
    
    console.log('[ModifyDialog] Matched tech:', matchingTech?.name || 'none');
    
    // Set form state
    setTechnicianName(matchingTech?.name || "");
    setScheduledDate(suggestion.scheduledDate || "");
    setScheduledTime(suggestion.scheduledTime || "");
    setCustomerName(suggestion.customerName || "");
    setCustomerPhone(suggestion.customerPhone || "");
    
    // Parse services from comma-separated string
    const services = suggestion.serviceType
      ? suggestion.serviceType.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    setSelectedServices(services);
  }
}, [open, suggestion, technicians]);
```

**Key changes:**
- Add debug logging to trace matching failures
- Normalize whitespace in names (collapse multiple spaces)
- Skip matching if technician name is "Unassigned"
- Add partial name containment matching as fallback
- Don't fallback to `suggestion.technicianName` if no match found (leave blank to indicate issue)

#### 2. `src/components/job-map/BookingSuggestionPanel.tsx`

**Enhance technician ID resolution (around line 233):**

```typescript
// In the structured suggestions mapping
const structured = data.suggestions.map((s, idx): SchedulingSuggestion => {
  // Robust technician ID lookup with fallback to partial matching
  let techId = hcpTechIdByName.get(normalizeName(s.suggestedTechnician));
  
  // If exact match failed, try partial matching
  if (!techId && s.suggestedTechnician) {
    const suggestedNorm = normalizeName(s.suggestedTechnician);
    for (const [techName, id] of hcpTechIdByName.entries()) {
      if (techName.includes(suggestedNorm) || suggestedNorm.includes(techName)) {
        techId = id;
        break;
      }
    }
  }
  
  return {
    id: `suggestion-${idx}-${Date.now()}`,
    technicianName: s.suggestedTechnician || "Unassigned",
    technicianId: techId,
    // ... rest of properties
  };
});
```

---

## Testing Checklist

After implementation:
1. Generate AI suggestions for a job with a technician recommendation
2. Click "Modify" on a suggestion card
3. Verify the "Assign To" dropdown shows the suggested technician pre-filled
4. Verify Services, Customer Name, Phone, Date, and Time are all populated
5. Make changes and confirm the job is created with the modified values
6. Test with an "Unassigned" suggestion - dropdown should show "Unassigned" selected

