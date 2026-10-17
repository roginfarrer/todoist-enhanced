# Task assignees (#203)

## Scope

Personal views default to Me + unassigned. Projects show Everyone. Search and saved Todoist filters retain their global/query scope; project Insights remain collective. Assignment choices are stored per view and account.

Assignment is editable in task rows, task detail and the composer when the project permits it. Adding from an assignee group prefills that person while preserving real project/section placement. Changing project clears an ineligible assignee with an explanation.

Workspace filters support multiple choices, All and a deliberate empty selection. Review exposes only Assignee; Dashboard exposes Workspace and Assignee inside Display. The Dashboard's action order is Edit layout / Display / Logbook.

## Automated checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Standard demo regressions: `npx playwright test`.
- Assignment fixtures: `PLAYWRIGHT_DEV=1 PLAYWRIGHT_PORT=4174 npx playwright test e2e/assignees.spec.ts`.
- CI runs both browser commands. Fixtures modify only demo state, never a real account.

## Manual acceptance

Use a shared project with two collaborators and a personal project. Prepare tasks assigned to me, to nobody and to each colleague, with overdue/today/future/undated/recurring/completed tasks and parent/child assignments that differ.

| View | Expected default / coverage |
| --- | --- |
| Today, Inbox, My week, Upcoming, Someday, tags | Me + unassigned; each person, combined, empty and Everyone selections |
| Project list and board | Everyone; persistent avatar before the more menu; assignment, assignee group/sort and real sections |
| Review | Personal assignee scope; compact filter beside Daily/Weekly; avatar after the title; completed tasks and actions |
| Eisenhower | Personal assignee scope; workspace multiselect; quadrant counts and estimates |
| Dashboard | Personal scope; Display filters both current and previous period statistics; Edit layout hover/focus label; card reordering; Logbook link |
| Search and saved filters | Colleague tasks remain discoverable; saved-query semantics are retained |
| Project Insights | Collective project statistics |

For every applicable view, check persisted preferences after reload/account switch; intersections with other filters; visible counts and workload; hidden tasks excluded from bulk selection; me-assigned child with a colleague-assigned parent; unknown/deleted collaborators; FR/EN, keyboard, mobile and dark/light modes.

Verify mutations in the official Todoist app: assign/unassign, create in a section, create from a person group, change project, and reload. Test insufficient permissions, stale memberships, refusal/rollback and no duplicate creation. Check existing and newly shared projects, without inferring invitation/role behaviour from the demo.

The assignee popup must fit the viewport; avatars have a circular image or initials fallback. Workspace logos fall back to a coloured initial. Display popups overlay content instead of shifting it.

Upcoming hides its extension button when no more visible tasks exist. A task beyond the horizon restores the button. Contextual Add task prefills its date, but natural text such as `dans un mois` overrides it; calendar months clamp to the last valid day.

## Release

Published changes are described in the 2.7.0 sections of CHANGELOG.md and CHANGELOG.fr.md. The completed-project-task issue #229 remains outside this release.
