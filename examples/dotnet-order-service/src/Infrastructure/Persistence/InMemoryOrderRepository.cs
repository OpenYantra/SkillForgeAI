using System.Collections.Concurrent;
using OrderService.Domain.Entities;
using OrderService.Domain.Ports;

namespace OrderService.Infrastructure.Persistence;

public class InMemoryOrderRepository : IOrderRepository
{
    private readonly ConcurrentDictionary<Guid, Order> _orders = new();

    public Task<Order?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _orders.TryGetValue(id, out var order);
        return Task.FromResult(order);
    }

    public Task SaveAsync(Order order, CancellationToken cancellationToken = default)
    {
        _orders[order.Id] = order;
        return Task.CompletedTask;
    }
}
