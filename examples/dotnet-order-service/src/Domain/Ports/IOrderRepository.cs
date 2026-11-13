using OrderService.Domain.Entities;

namespace OrderService.Domain.Ports;

public interface IOrderRepository
{
    Task<Order?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task SaveAsync(Order order, CancellationToken cancellationToken = default);
}
