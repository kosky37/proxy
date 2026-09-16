namespace ProxyMockTool.Infrastructure.Listeners;

internal sealed class TeeStream : Stream
{
    private readonly Stream _primary;
    private readonly MemoryStream _copy;

    public TeeStream(Stream primary, MemoryStream copy)
    {
        _primary = primary;
        _copy = copy;
    }

    public override bool CanRead => false;
    public override bool CanSeek => false;
    public override bool CanWrite => true;
    public override long Length => _copy.Length;
    public override long Position
    {
        get => _copy.Position;
        set => throw new NotSupportedException();
    }

    public override void Flush() => _primary.Flush();
    public override Task FlushAsync(CancellationToken cancellationToken) => _primary.FlushAsync(cancellationToken);

    public override void Write(byte[] buffer, int offset, int count)
    {
        _primary.Write(buffer, offset, count);
        _copy.Write(buffer, offset, count);
    }

    public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        await _primary.WriteAsync(buffer.AsMemory(offset, count), cancellationToken);
        await _copy.WriteAsync(buffer.AsMemory(offset, count), cancellationToken);
    }

    public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
    {
        await _primary.WriteAsync(buffer, cancellationToken);
        await _copy.WriteAsync(buffer, cancellationToken);
    }

    public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
}
