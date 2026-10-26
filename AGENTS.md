# Project rules
- Keep CRM report model selection separate from the existing CRP generation branch; Psychology remains unchanged.
- Share report model definitions between UI and edge generation so inference rules cannot diverge.
- Resolve report models server-side from owner-scoped custom models and organization policy; client input cannot override a locked organization.
- Persist the selected model snapshot and scope version with each generated CRM document and its audit entry.
- Store document formatting independently from clinical models and apply it to both report and prescription exports.