using System.Reflection;
using Xunit;

namespace OrderService.Tests;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        Console.WriteLine("\n▶ OrderService.Tests (.NET 10.0 xUnit Suite)");

        var testClass = typeof(OrderServiceTests);
        var methods = testClass.GetMethods()
            .Where(m => m.GetCustomAttribute<FactAttribute>() != null)
            .ToList();

        int passed = 0;
        int failed = 0;
        var sw = System.Diagnostics.Stopwatch.StartNew();

        foreach (var method in methods)
        {
            var instance = Activator.CreateInstance(testClass);
            try
            {
                var result = method.Invoke(instance, null);
                if (result is Task task)
                {
                    await task;
                }
                Console.WriteLine($"  ✔ {method.Name} (passed)");
                passed++;
            }
            catch (TargetInvocationException ex)
            {
                var inner = ex.InnerException ?? ex;
                Console.WriteLine($"  ✖ {method.Name}: {inner.GetType().Name} - {inner.Message}");
                failed++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  ✖ {method.Name}: {ex.Message}");
                failed++;
            }
        }

        sw.Stop();
        Console.WriteLine($"\n✔ OrderService.Tests Completed in {sw.ElapsedMilliseconds}ms");
        Console.WriteLine($"ℹ tests {passed + failed}");
        Console.WriteLine($"ℹ pass {passed}");
        Console.WriteLine($"ℹ fail {failed}\n");

        return failed == 0 ? 0 : 1;
    }
}
