using Microsoft.EntityFrameworkCore;

namespace Proxy.Infrastructure.Logging;

public sealed class RequestLogDbContext : DbContext
{
    public RequestLogDbContext(DbContextOptions<RequestLogDbContext> options) : base(options)
    {
    }

    public DbSet<RequestLogRecord> Logs => Set<RequestLogRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<RequestLogRecord>();
        entity.ToTable("RequestLogs");
        entity.HasKey(item => item.Id);
        entity.Property(item => item.Id).ValueGeneratedOnAdd();
        entity.HasIndex(item => item.TimestampUtc);
        entity.HasIndex(item => item.Path);
        entity.HasIndex(item => item.Mode);
    }
}
