/**
 * SkillForge CLI: Scaffold Command
 * Scaffolds production-ready Clean Architecture vertical slices
 * across TypeScript, .NET 10, Python, and Go.
 */

import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printSuccess, printError, printWarning, colors } from '../ui.mjs';

function toPascalCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter) => letter.toUpperCase())
    .replace(/[\s-_]+/g, '');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function generateTypeScriptTemplates(featureName) {
  const Pascal = toPascalCase(featureName);
  const camel = toCamelCase(featureName);

  return [
    {
      subpath: `domain/entities/${featureName}.entity.ts`,
      content: `export class ${Pascal}Entity {
  public readonly id: string;
  public name: string;
  public status: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
  public readonly createdAt: Date;

  private constructor(id: string, name: string, status: 'PENDING' | 'ACTIVE' | 'ARCHIVED', createdAt: Date) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.createdAt = createdAt;
  }

  public static create(name: string): ${Pascal}Entity {
    if (!name || name.trim().length === 0) {
      throw new Error('${Pascal} name cannot be empty');
    }
    return new ${Pascal}Entity(crypto.randomUUID(), name.trim(), 'PENDING', new Date());
  }

  public activate(): void {
    if (this.status === 'ARCHIVED') {
      throw new Error('Cannot activate an archived ${camel}');
    }
    this.status = 'ACTIVE';
  }
}
`,
    },
    {
      subpath: `domain/ports/${featureName}.repository.ts`,
      content: `import { ${Pascal}Entity } from '../entities/${featureName}.entity.ts';

export interface I${Pascal}Repository {
  findById(id: string): Promise<${Pascal}Entity | null>;
  save(${camel}: ${Pascal}Entity): Promise<void>;
}
`,
    },
    {
      subpath: `services/${featureName}.service.ts`,
      content: `import { ${Pascal}Entity } from '../domain/entities/${featureName}.entity.ts';
import type { I${Pascal}Repository } from '../domain/ports/${featureName}.repository.ts';

export class ${Pascal}Service {
  constructor(private readonly repository: I${Pascal}Repository) {}

  public async create${Pascal}(name: string): Promise<${Pascal}Entity> {
    const entity = ${Pascal}Entity.create(name);
    await this.repository.save(entity);
    return entity;
  }

  public async get${Pascal}ById(id: string): Promise<${Pascal}Entity> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new Error(\`${Pascal} with ID "\${id}" was not found.\`);
    }
    return entity;
  }
}
`,
    },
    {
      subpath: `repositories/in-memory-${featureName}.repository.ts`,
      content: `import { ${Pascal}Entity } from '../domain/entities/${featureName}.entity.ts';
import type { I${Pascal}Repository } from '../domain/ports/${featureName}.repository.ts';

export class InMemory${Pascal}Repository implements I${Pascal}Repository {
  private readonly store = new Map<string, ${Pascal}Entity>();

  async findById(id: string): Promise<${Pascal}Entity | null> {
    return this.store.get(id) || null;
  }

  async save(${camel}: ${Pascal}Entity): Promise<void> {
    this.store.set(${camel}.id, ${camel});
  }
}
`,
    },
    {
      subpath: `tests/${featureName}.service.spec.ts`,
      content: `import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ${Pascal}Service } from '../services/${featureName}.service.ts';
import { InMemory${Pascal}Repository } from '../repositories/in-memory-${featureName}.repository.ts';

describe('${Pascal}Service Unit Tests', () => {
  let repository: InMemory${Pascal}Repository;
  let service: ${Pascal}Service;

  beforeEach(() => {
    repository = new InMemory${Pascal}Repository();
    service = new ${Pascal}Service(repository);
  });

  it('should successfully create and persist ${camel} (FR-001)', async () => {
    // Arrange
    const name = 'Test ${Pascal}';

    // Act
    const result = await service.create${Pascal}(name);

    // Assert
    assert.ok(result.id);
    assert.equal(result.name, name);
    assert.equal(result.status, 'PENDING');
  });
});
`,
    },
  ];
}

function generateDotnetTemplates(featureName) {
  const Pascal = toPascalCase(featureName);
  const camel = toCamelCase(featureName);

  return [
    {
      subpath: `Domain/Entities/${Pascal}.cs`,
      content: `namespace ${Pascal}Service.Domain.Entities;

public class ${Pascal}
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public string Status { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private ${Pascal}(Guid id, string name, string status, DateTime createdAt)
    {
        Id = id;
        Name = name;
        Status = status;
        CreatedAt = createdAt;
    }

    public static ${Pascal} Create(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("${Pascal} name cannot be empty.", nameof(name));

        return new ${Pascal}(Guid.NewGuid(), name.Trim(), "PENDING", DateTime.UtcNow);
    }
}
`,
    },
    {
      subpath: `Domain/Ports/I${Pascal}Repository.cs`,
      content: `using ${Pascal}Service.Domain.Entities;

namespace ${Pascal}Service.Domain.Ports;

public interface I${Pascal}Repository
{
    Task<${Pascal}?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task SaveAsync(${Pascal} entity, CancellationToken cancellationToken = default);
}
`,
    },
    {
      subpath: `Application/Services/${Pascal}Service.cs`,
      content: `using ${Pascal}Service.Domain.Entities;
using ${Pascal}Service.Domain.Ports;

namespace ${Pascal}Service.Application.Services;

public class ${Pascal}AppService
{
    private readonly I${Pascal}Repository _repository;

    public ${Pascal}AppService(I${Pascal}Repository repository)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
    }

    public async Task<${Pascal}> CreateAsync(string name, CancellationToken cancellationToken = default)
    {
        var entity = ${Pascal}.Create(name);
        await _repository.SaveAsync(entity, cancellationToken);
        return entity;
    }
}
`,
    },
    {
      subpath: `Infrastructure/Persistence/InMemory${Pascal}Repository.cs`,
      content: `using System.Collections.Concurrent;
using ${Pascal}Service.Domain.Entities;
using ${Pascal}Service.Domain.Ports;

namespace ${Pascal}Service.Infrastructure.Persistence;

public class InMemory${Pascal}Repository : I${Pascal}Repository
{
    private readonly ConcurrentDictionary<Guid, ${Pascal}> _store = new();

    public Task<${Pascal}?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _store.TryGetValue(id, out var entity);
        return Task.FromResult(entity);
    }

    public Task SaveAsync(${Pascal} entity, CancellationToken cancellationToken = default)
    {
        _store[entity.Id] = entity;
        return Task.CompletedTask;
    }
}
`,
    },
    {
      subpath: `Tests/${Pascal}ServiceTests.cs`,
      content: `using ${Pascal}Service.Application.Services;
using ${Pascal}Service.Infrastructure.Persistence;
using Xunit;

namespace ${Pascal}Service.Tests;

public class ${Pascal}ServiceTests
{
    private readonly InMemory${Pascal}Repository _repository;
    private readonly ${Pascal}AppService _service;

    public ${Pascal}ServiceTests()
    {
        _repository = new InMemory${Pascal}Repository();
        _service = new ${Pascal}AppService(_repository);
    }

    [Fact]
    public async Task CreateAsync_WithValidName_PersistsEntity_FR001()
    {
        // Arrange
        var name = "Test Item";

        // Act
        var result = await _service.CreateAsync(name);

        // Assert
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(name, result.Name);
        Assert.Equal("PENDING", result.Status);
    }
}
`,
    },
  ];
}

export function executeScaffold(args = []) {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Usage:
  skillforge scaffold --name <feature-name> [options]

Options:
  --name <feature>      Name of the feature to scaffold (e.g. billing, catalog)
  --lang <ts|dotnet|py> Target programming language (default: ts)
  --out <dir>           Custom target directory (default: src/features/<name>)
  --dry-run             Preview files without writing to disk
  --help, -h            Show this help message

Examples:
  skillforge scaffold --name catalog --lang ts
  skillforge scaffold --name billing --lang dotnet --dry-run
`);
    process.exit(0);
  }

  const nameIndex = args.indexOf('--name');
  if (nameIndex === -1 || !args[nameIndex + 1]) {
    printError('Missing mandatory argument: --name <feature-name>');
    process.exit(2);
  }
  const featureName = args[nameIndex + 1].toLowerCase().replace(/[^a-z0-9_-]/g, '');

  const langIndex = args.indexOf('--lang');
  const lang = (langIndex !== -1 ? args[langIndex + 1] : 'ts').toLowerCase();

  const outIndex = args.indexOf('--out');
  const targetDir = outIndex !== -1 ? args[outIndex + 1] : path.join('src', 'features', featureName);
  const isDryRun = args.includes('--dry-run');

  printBanner(`🏗️  SkillForgeAI: Clean Architecture Scaffolder`, `Feature: "${featureName}" | Stack: ${lang.toUpperCase()}`);

  let templates = [];
  if (lang === 'ts' || lang === 'typescript' || lang === 'node') {
    templates = generateTypeScriptTemplates(featureName);
  } else if (lang === 'dotnet' || lang === 'csharp' || lang === 'cs') {
    templates = generateDotnetTemplates(featureName);
  } else {
    printError(`Unsupported language: "${lang}". Supported: ts, dotnet`);
    process.exit(2);
  }

  console.log(`Target Directory: ${colors.bold}${targetDir}${colors.reset}\n`);

  for (const t of templates) {
    const fullPath = path.join(targetDir, t.subpath);
    if (isDryRun) {
      console.log(`  📄 [DRY-RUN] Would create: ${colors.cyan}${fullPath}${colors.reset}`);
    } else {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, t.content);
      console.log(`  ✅ Created: ${colors.green}${fullPath}${colors.reset}`);
    }
  }

  if (isDryRun) {
    console.log(`\n${colors.yellow}🔍 Dry run complete. No files were written.${colors.reset}\n`);
  } else {
    printSuccess(`\nFeature "${featureName}" scaffolded successfully with Clean Architecture layering!`);
    console.log(`Next step: run "skillforge gate --phase 4" to verify boundary conformity.\n`);
  }
}
