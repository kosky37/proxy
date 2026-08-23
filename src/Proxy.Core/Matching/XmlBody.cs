using System.Xml;
using System.Xml.Linq;
using System.Xml.XPath;

namespace Proxy.Core.Matching;

public static class XmlBody
{
    public static bool TryParse(string? body, out XDocument? document)
    {
        document = null;
        if (string.IsNullOrWhiteSpace(body))
        {
            return false;
        }

        try
        {
            document = XDocument.Parse(body, LoadOptions.PreserveWhitespace);
            return document.Root is not null;
        }
        catch (XmlException)
        {
            return false;
        }
    }

    public static bool XPathMatches(XDocument document, string xpath)
    {
        try
        {
            var navigator = document.CreateNavigator();
            if (navigator is null)
            {
                return false;
            }

            var result = navigator.Evaluate(xpath);
            return result switch
            {
                bool flag => flag,
                double number => number != 0,
                string text => !string.IsNullOrWhiteSpace(text),
                XPathNodeIterator iterator => iterator.Count > 0 || iterator.MoveNext(),
                _ => result is not null
            };
        }
        catch (XPathException)
        {
            return false;
        }
    }
}
