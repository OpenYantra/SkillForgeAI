using OrderService.Domain.Entities;
using OrderService.Domain.Exceptions;
using OrderService.Domain.Ports;

namespace OrderService.Application.Services;

public class OrderApplicationService
{
    private readonly IOrderRepository _repository;

    public OrderApplicationService(IOrderRepository repository)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
    }

    public async Task<Order> CreateOrderAsync(string customerId, List<OrderItem> items, CancellationToken cancellationToken = default)
    {
        var order = Order.Create(customerId, items);
        await _repository.SaveAsync(order, cancellationToken);
        return order;
    }

    public async Task<Order> GetOrderByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await _repository.FindByIdAsync(id, cancellationToken);
        if (order == null)
            throw new OrderNotFoundException(id);
        return order;
    }

    public async Task<Order> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await GetOrderByIdAsync(id, cancellationToken);
        order.Cancel();
        await _repository.SaveAsync(order, cancellationToken);
        return order;
    }
}
