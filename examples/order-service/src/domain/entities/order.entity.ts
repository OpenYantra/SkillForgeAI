export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateTransitionError';
  }
}

export interface OrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderProps {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  createdAt: Date;
}

export class OrderEntity {
  private props: OrderProps;

  private constructor(props: OrderProps) {
    this.props = props;
  }

  public static create(customerId: string, items: OrderItem[]): OrderEntity {
    if (!customerId || customerId.trim() === '') {
      throw new DomainValidationError('Customer ID is required');
    }
    if (!items || items.length === 0) {
      throw new DomainValidationError('Order must contain at least one item');
    }

    const total = items.reduce((sum, item) => {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new DomainValidationError('Invalid item quantity or unit price');
      }
      return sum + item.quantity * item.unitPrice;
    }, 0);

    const roundedTotal = Math.round(total * 100) / 100;

    return new OrderEntity({
      id: crypto.randomUUID(),
      customerId: customerId.trim(),
      items: [...items],
      totalAmount: roundedTotal,
      status: 'PENDING',
      createdAt: new Date(),
    });
  }

  public cancel(): void {
    if (this.props.status === 'CANCELLED') {
      throw new InvalidStateTransitionError('Order is already cancelled');
    }
    if (this.props.status === 'PAID') {
      throw new InvalidStateTransitionError('Paid orders cannot be cancelled directly');
    }
    this.props.status = 'CANCELLED';
  }

  public toJSON(): Readonly<OrderProps> {
    return Object.freeze({ ...this.props, items: [...this.props.items] });
  }
}
