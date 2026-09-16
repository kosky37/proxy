using AwesomeAssertions;
using ProxyMockTool.Infrastructure.Listeners;

namespace ProxyMockTool.Tests;

public class BodyLimiterTests
{
    [Fact]
    public void Keeps_body_at_or_under_the_limit()
    {
        var result = BodyLimiter.Limit("hello", 16);

        result.Text.Should().Be("hello");
        result.OriginalBytes.Should().Be(5);
        result.Exceeded.Should().BeFalse();
    }

    [Fact]
    public void Omits_body_when_it_exceeds_the_limit()
    {
        var result = BodyLimiter.Limit(new string('x', 32), 8);

        result.Text.Should().BeNull();
        result.OriginalBytes.Should().Be(32);
        result.Exceeded.Should().BeTrue();
    }

    [Fact]
    public void Treats_zero_limit_as_unlimited()
    {
        var body = new string('x', 64);

        var result = BodyLimiter.Limit(body, 0);

        result.Text.Should().Be(body);
        result.Exceeded.Should().BeFalse();
    }
}
