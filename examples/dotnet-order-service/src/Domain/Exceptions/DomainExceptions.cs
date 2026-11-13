namespace OrderService.Domain.Exceptions;

public class DomainValidationException : Exception
{
    public DomainValidationException(string message) : base(message) { }
}

public class InvalidStateTransitionException : Exception
{
    public InvalidStateTransitionException(string message) : base(message) { }
}

public class OrderNotFoundException : Exception
{
    public OrderNotFoundException(Guid id) : base($"Order with ID '{id}' was not found.") { }
}
