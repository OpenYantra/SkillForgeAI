namespace OrderService.Domain.Entities;

public record OrderItem(string Sku, int Quantity, decimal UnitPrice)
{
    public decimal LineTotal => Math.Round(Quantity * UnitPrice, 2);
}
