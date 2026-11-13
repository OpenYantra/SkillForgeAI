using OrderService.Application.Services;
using OrderService.Domain.Entities;
using OrderService.Domain.Exceptions;
using OrderService.Infrastructure.Persistence;
using Xunit;

namespace OrderService.Tests;

public class OrderServiceTests
{
    private readonly InMemoryOrderRepository _repository;
    private readonly OrderApplicationService _service;

    public OrderServiceTests()
    {
        // Arrange: Isolated fake repository per test run
        _repository = new InMemoryOrderRepository();
        _service = new OrderApplicationService(_repository);
    }

    [Fact]
    public async Task CreateOrder_WithValidItems_CalculatesTotalAndPersistsPendingOrder_FR001()
    {
        // Arrange
        var customerId = "cust-net10-101";
        var items = new List<OrderItem>
        {
            new("SKU-100", 2, 25.50m),
            new("SKU-200", 1, 10.00m)
        };

        // Act
        var order = await _service.CreateOrderAsync(customerId, items);

        // Assert
        Assert.NotEqual(Guid.Empty, order.Id);
        Assert.Equal(customerId, order.CustomerId);
        Assert.Equal(OrderStatus.Pending, order.Status);
        Assert.Equal(61.00m, order.TotalAmount); // (2 * 25.50) + (1 * 10.00) = 61.00

        var persisted = await _repository.FindByIdAsync(order.Id);
        Assert.NotNull(persisted);
        Assert.Equal(order.Id, persisted.Id);
    }

    [Fact]
    public async Task CreateOrder_WithFloatingTotals_RoundsSafelyToTwoDecimals_EC003()
    {
        // Arrange
        var customerId = "cust-net10-102";
        var items = new List<OrderItem>
        {
            new("SKU-FLOAT", 3, 1.111m)
        };

        // Act
        var order = await _service.CreateOrderAsync(customerId, items);

        // Assert
        Assert.Equal(3.33m, order.TotalAmount);
    }

    [Fact]
    public async Task CreateOrder_WithEmptyItems_ThrowsDomainValidationException_EC001()
    {
        // Arrange
        var customerId = "cust-net10-103";
        var emptyItems = new List<OrderItem>();

        // Act & Assert
        await Assert.ThrowsAsync<DomainValidationException>(() =>
            _service.CreateOrderAsync(customerId, emptyItems));
    }

    [Fact]
    public async Task CancelOrder_WhenOrderIsPending_TransitionsToCancelled_FR002()
    {
        // Arrange
        var order = await _service.CreateOrderAsync("cust-net10-201", new List<OrderItem>
        {
            new("SKU-CANCEL", 1, 50.00m)
        });

        // Act
        var cancelled = await _service.CancelOrderAsync(order.Id);

        // Assert
        Assert.Equal(OrderStatus.Cancelled, cancelled.Status);

        var persisted = await _repository.FindByIdAsync(order.Id);
        Assert.NotNull(persisted);
        Assert.Equal(OrderStatus.Cancelled, persisted.Status);
    }

    [Fact]
    public async Task CancelOrder_WhenOrderIsAlreadyCancelled_ThrowsInvalidStateTransitionException_EC002()
    {
        // Arrange
        var order = await _service.CreateOrderAsync("cust-net10-202", new List<OrderItem>
        {
            new("SKU-DOUBLE-CANCEL", 1, 40.00m)
        });
        await _service.CancelOrderAsync(order.Id);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidStateTransitionException>(() =>
            _service.CancelOrderAsync(order.Id));
    }

    [Fact]
    public async Task GetOrderById_WhenExists_ReturnsOrder_FR003()
    {
        // Arrange
        var created = await _service.CreateOrderAsync("cust-net10-301", new List<OrderItem>
        {
            new("SKU-GET", 1, 15.00m)
        });

        // Act
        var fetched = await _service.GetOrderByIdAsync(created.Id);

        // Assert
        Assert.Equal(created.Id, fetched.Id);
    }

    [Fact]
    public async Task GetOrderById_WhenNotFound_ThrowsOrderNotFoundException_FR003()
    {
        // Arrange
        var nonExistentId = Guid.NewGuid();

        // Act & Assert
        await Assert.ThrowsAsync<OrderNotFoundException>(() =>
            _service.GetOrderByIdAsync(nonExistentId));
    }
}
