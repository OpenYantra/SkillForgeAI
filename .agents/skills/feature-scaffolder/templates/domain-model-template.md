# Feature Scaffolding Templates (TypeScript / Node.js Standard)

Use these templates as standard patterns when scaffolding new features.

---

## 1. Domain Entity (`domain/entities/[feature].entity.ts`)

```typescript
export interface FeatureEntityProps {
  id: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

export class FeatureEntity {
  private constructor(private readonly props: FeatureEntityProps) {}

  public static create(name: string): FeatureEntity {
    if (!name || name.trim().length === 0) {
      throw new Error('Feature name cannot be empty');
    }
    return new FeatureEntity({
      id: crypto.randomUUID(),
      name: name.trim(),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public activate(): void {
    if (this.props.status === 'ARCHIVED') {
      throw new Error('Cannot activate an archived feature');
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  public toJSON(): Readonly<FeatureEntityProps> {
    return Object.freeze({ ...this.props });
  }
}
```

---

## 2. Port / Repository Interface (`domain/ports/[feature].repository.ts`)

```typescript
import { FeatureEntity } from '../entities/feature.entity.js';

export interface IFeatureRepository {
  findById(id: string): Promise<FeatureEntity | null>;
  findByName(name: string): Promise<FeatureEntity | null>;
  save(entity: FeatureEntity): Promise<void>;
  delete(id: string): Promise<void>;
}
```

---

## 3. Application Service / Use Case (`services/[feature].service.ts`)

```typescript
import { FeatureEntity } from '../domain/entities/feature.entity.js';
import { IFeatureRepository } from '../domain/ports/feature.repository.js';

export class FeatureAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Feature with name "${name}" already exists.`);
    this.name = 'FeatureAlreadyExistsError';
  }
}

export class FeatureService {
  constructor(private readonly repository: IFeatureRepository) {}

  public async createFeature(name: string): Promise<FeatureEntity> {
    const existing = await this.repository.findByName(name);
    if (existing) {
      throw new FeatureAlreadyExistsError(name);
    }

    const feature = FeatureEntity.create(name);
    await this.repository.save(feature);
    return feature;
  }
}
```

---

## 4. In-Memory Mock Repository for Immediate Testing (`repositories/in-memory-[feature].repository.ts`)

```typescript
import { FeatureEntity } from '../domain/entities/feature.entity.js';
import { IFeatureRepository } from '../domain/ports/feature.repository.js';

export class InMemoryFeatureRepository implements IFeatureRepository {
  private readonly items = new Map<string, FeatureEntity>();

  async findById(id: string): Promise<FeatureEntity | null> {
    return this.items.get(id) || null;
  }

  async findByName(name: string): Promise<FeatureEntity | null> {
    for (const entity of this.items.values()) {
      if (entity.toJSON().name.toLowerCase() === name.toLowerCase()) {
        return entity;
      }
    }
    return null;
  }

  async save(entity: FeatureEntity): Promise<void> {
    this.items.set(entity.toJSON().id, entity);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
```
