using AwesomeAssertions;
using ProxyMockTool.Core.Storage;

namespace ProxyMockTool.Tests;

public class MockFileNamesTests
{
    [Fact]
    public void Toggle_prepends_and_removes_prefix()
    {
        MockFileNames.ToggleFileName("hello.json", "_").Should().Be("_hello.json");
        MockFileNames.ToggleFileName("_hello.json", "_").Should().Be("hello.json");
    }

    [Fact]
    public void Logical_name_strips_prefix_and_extension()
    {
        MockFileNames.GetLogicalName("_slow-create.json", "_").Should().Be("slow-create");
        MockFileNames.GetLogicalName("hello.json", "_").Should().Be("hello");
    }

    [Fact]
    public void Disabled_is_detected_from_prefix()
    {
        MockFileNames.IsDisabled("_x.json", "_").Should().BeTrue();
        MockFileNames.IsDisabled("x.json", "_").Should().BeFalse();
    }
}
