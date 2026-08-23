using Proxy.Core.Models;

namespace Proxy.Core.Contracts;

public interface IProxyConfigStore
{
    event EventHandler? Changed;

    IReadOnlyList<LoadedProxy> GetAll();
    LoadedProxy? Get(string id);
    LoadedProxy Create(string id, ProxyDefinition definition);
    LoadedProxy Update(string id, ProxyDefinition definition);
    void Delete(string id);
    MockDefinition CreateMock(string proxyId, MockDefinition mock);
    MockDefinition UpdateMock(string proxyId, string name, MockDefinition mock);
    void DeleteMock(string proxyId, string name);
    MockDefinition ToggleMock(string proxyId, string name);
    LoadedProxy SetMocksEnabled(string proxyId, bool enabled);
    void Reload();
}
