# UML diagrams

| Source | Rendered | Shows |
|---|---|---|
| `class-diagram.puml` | `kadence-class-diagram.png` / `.svg` | Domain entities, attributes, types, keys, constraints, multiplicities (matches `prisma/schema.prisma`) |
| `sequence-change-goal-priority.puml` | `kadence-sequence-change-goal-priority.png` / `.svg` | User story "change a goal's priority": UI → Express API → GoalService → Prisma → PostgreSQL |

Output file names come from the name after `@startuml` in each source file.

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
