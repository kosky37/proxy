using System.IO.Pipelines;
using Microsoft.AspNetCore.Http.Features;

namespace ProxyMockTool.Infrastructure.Listeners;

internal sealed class CapturingResponseBodyFeature : IHttpResponseBodyFeature
{
    private readonly IHttpResponseBodyFeature _inner;

    public CapturingResponseBodyFeature(IHttpResponseBodyFeature inner)
    {
        _inner = inner;
        Capture = new MemoryStream();
        Stream = new TeeStream(inner.Stream, Capture);
        Writer = PipeWriter.Create(Stream);
    }

    public MemoryStream Capture { get; }
    public Stream Stream { get; }
    public PipeWriter Writer { get; }

    public void DisableBuffering() => _inner.DisableBuffering();

    public Task StartAsync(CancellationToken cancellationToken = default) => _inner.StartAsync(cancellationToken);

    public Task CompleteAsync() => _inner.CompleteAsync();

    public Task SendFileAsync(string path, long offset, long? count, CancellationToken cancellationToken = default) =>
        _inner.SendFileAsync(path, offset, count, cancellationToken);
}
