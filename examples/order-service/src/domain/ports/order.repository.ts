import { OrderEntity } from '../entities/order.entity.ts';

export interface IOrderRepository {
  findById(id: string): Promise<OrderEntity | null>;
  save(order: OrderEntity): Promise<void>;
}
