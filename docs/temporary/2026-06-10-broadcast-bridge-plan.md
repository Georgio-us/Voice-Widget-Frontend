# 2026-06-10 Broadcast Bridge Plan

Temporary product/architecture note. This file can be removed after the broadcast bridge is implemented and verified.

## Goal

Connect the existing client broadcast flow with the already existing property and selection sharing mechanics, without creating new database entities.

Current product entities already exist:

- News broadcast: admin sends custom text, optional image, and CTA to selected clients.
- Single property share: existing property deep link `/s/p/{propertyId}`.
- Property selection share: existing selection deep link `/s/s/{selectionToken}`.
- Admin properties and wishlist screens already know how to select property cards and share them.

The missing part is a UX/backend bridge that lets the broadcast editor attach either no property target, one property target, or multiple property targets.

## Proposed UX Flow

1. Admin opens `Clients`.
2. Admin searches and selects target clients.
3. Admin clicks `Create broadcast`.
4. Instead of opening the text editor immediately, show a scenario choice screen with three large cards:
   - News: current free-form broadcast.
   - Property: send one selected property.
   - Selection: send one or more selected properties.
5. News opens the current broadcast editor unchanged.
6. Property/Selection opens a property picker based on the existing `My objects` UI, but in broadcast-pick mode:
   - no edit button;
   - no delete button;
   - no native share buttons;
   - selected objects are confirmed by a CTA like `Add to broadcast`.
7. After property picking, return to the broadcast editor.
8. Broadcast editor shows:
   - selected clients count and removable selected clients list;
   - selected properties count and removable selected properties list;
   - message text;
   - CTA label;
   - optional uploaded image;
   - optional action to use the first selected property image as broadcast image in a later stage.
9. Preview shows final text, image, CTA label, target clients, and whether CTA opens one property or a selection.
10. Send uses the existing broadcast pipeline.

## Product Rules

- Selection broadcast limit: maximum 10 properties.
- If an admin tries to select the 11th property, the UI blocks it and shows a soft notice.
- `messageText` is required for every broadcast scenario.
- `ctaText` is required for every broadcast scenario.
- Do not auto-fill default CTA text. If CTA is empty, preview/send must be blocked.
- No persistent drafts for broadcasts: no localStorage, no database draft, no auto-restore.
- Temporary in-modal state is allowed only while the modal is open.
- If the admin already typed text, changed CTA, uploaded a photo, or selected properties and then tries to leave/switch scenario, show a confirmation modal:
  - Continue editing;
  - Exit without saving.
- First implementation stage keeps manual photo upload only.
- Reusing the first property photo is a later enhancement, not part of the first safe implementation.

## Data Contract Extension

No new DB table is required.

Extend the current `/api/admin/broadcast` payload with optional fields:

```json
{
  "targetUserIds": ["123"],
  "messageText": "...",
  "ctaText": "...",
  "photoUrl": "https://...",
  "selectedPropertyIds": ["SEED001", "SEED002"],
  "ctaUrl": "https://.../s/s/{selectionToken}"
}
```

Rules:

- If `selectedPropertyIds` is empty, broadcast is a news broadcast and CTA can open the mini app root.
- If `selectedPropertyIds.length === 1`, CTA opens `/s/p/{propertyId}`.
- If `selectedPropertyIds.length > 1`, CTA opens `/s/s/{selectionToken}`.
- `selectedPropertyIds.length` must not exceed 10.
- `messageText` and `ctaText` are mandatory.
- Backend should allow only safe internal CTA URLs from our own miniapp/share domain.
- Existing `sendTargetedBroadcast` can be reused; it only needs to accept a concrete CTA URL instead of always using the root miniapp URL.

## Implementation Stages

### Stage 1: Scenario Choice Screen

Add an intermediate screen after client selection:

- News;
- Property;
- Selection.

Do not change backend yet.

### Stage 2: Reusable Property Picker

Extract/reuse current admin object list UI in a selection-only mode for broadcasts.

### Stage 3: Broadcast Editor Extension

Add selected property IDs to editor state, display them, and allow removal before preview.

### Stage 4: Backend CTA URL

Allow `/api/admin/broadcast` to receive safe `ctaUrl` or `selectedPropertyIds` and build the correct internal CTA URL.

### Stage 5: Loss Confirmation

Add a confirmation dialog when an admin tries to abandon a non-empty broadcast editor/picker state.

### Stage 6: Later Image Enhancement

Optionally add `use first property photo` after the core broadcast bridge is stable.

### Stage 7: Smoke Tests

Test:

- news broadcast;
- one-property broadcast;
- multi-property selection broadcast;
- image upload;
- using property image;
- Ukrainian/Russian UI labels;
- Telegram delivery and button opening correct miniapp target.
