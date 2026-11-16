# UML diagrams

| Source | Rendered | Shows |
|---|---|---|
| `new_class_diagram_files/kadence-class-diagram.puml` | `new_class_diagram_files/kadence-class-diagram.png` / `.svg` | **Current** class diagram: domain entities, attributes, types, keys, constraints, multiplicities (matches `prisma/schema.prisma`) |
| `sequence-change-goal-priority.puml` | `kadence-sequence-change-goal-priority.png` / `.svg` | User story 2.4, "change a goal's priority" (issue #12): UI → Express API → GoalService → Prisma → PostgreSQL. Matches `PATCH /api/users/:userId/goals/:goalId/priority` and `updateGoalPriority` in `server/services/goalService.ts`. |
| `old_class_diagram_files/` | | Earlier version of the class diagram, kept for history; use `new_class_diagram_files/` |

Output file names come from the name after `@startuml` in each source file. The Sprint 2 feature
work added no tables or columns, so the class diagram did not need to change.

Attributes whose type contains parentheses (e.g. `String(50)`) are prefixed with `{field}`;
without it PlantUML treats them as methods and moves them to a separate compartment.

## Rendering

The class diagram uses `!pragma layout smetana`, so Graphviz is not required. Java 8+ is.

```sh
# plantuml.jar: from https://github.com/plantuml/plantuml/releases, or the copy bundled with the
# VS Code PlantUML extension (~/.vscode/extensions/jebbs.plantuml-<version>/plantuml.jar)
java -jar plantuml.jar -tpng docs/uml/*.puml
java -jar plantuml.jar -tsvg docs/uml/*.puml   # optional SVG versions
```

Or, in VS Code, install the "PlantUML" extension (jebbs.plantuml), open a `.puml` file and run
**PlantUML: Export Current Diagram** (set `plantuml.render` to `Local`).
