using OrderService.Domain.Exceptions;

namespace OrderService.Domain.Entities;

public enum OrderStatus
{
    Pending,
    Paid,
    Cancelled
}

public class Order
{
    public Guid Id { get; private set; }
    public string CustomerId { get; private set; }
    public IReadOnlyList<OrderItem> Items => _items.AsReadOnly();
    public decimal TotalAmount { get; private set; }
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private readonly List<OrderItem> _items;

    private Order(Guid id, string customerId, List<OrderItem> items, decimal totalAmount, OrderStatus status, DateTime createdAt)
    {
        Id = id;
        CustomerId = customerId;
        _items = items;
        TotalAmount = totalAmount;
        Status = status;
        CreatedAt = createdAt;
    }

    public static Order Create(string customerId, List<OrderItem> items)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new DomainValidationException("Customer ID is required.");

        if (items == null || items.Count == 0)
            throw new DomainValidationException("Order must contain at least one line item.");

        decimal total = 0;
        foreach (var item in items)
        {
            if (item.Quantity <= 0 || item.UnitPrice < 0)
                throw new DomainValidationException("Invalid line item quantity or unit price.");
            total += item.LineTotal;
        }

        return new Order(
            Guid.NewGuid(),
            customerId.Trim(),
            new List<OrderItem>(items),
            Math.Round(total, 2),
            OrderStatus.Pending,
            DateTime.UtcNow
        );
    }

    public void Cancel()
    {
        if (Status == OrderStatus.Cancelled)
            throw new InvalidStateTransitionException("Order is already cancelled.");

        if (Status == OrderStatus.Paid)
            throw new InvalidStateTransitionException("Paid orders cannot be cancelled directly.");

        Status = OrderStatus.Cancelled;
    }
}
