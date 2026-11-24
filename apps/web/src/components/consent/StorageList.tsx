import { Badge } from '@ad/ui';
import { visitorInventory } from '../../lib/consent/inventory';
import './consent.css';

/** The Privacy page storage table (S138 state 8, M45-S11 AC3). It reads the same list the code is tested against. */
export function StorageList() {
  const items = visitorInventory();
  return (
    <section id="storage" className="ad-storage" aria-labelledby="storage-heading">
      <h2 id="storage-heading" className="ad-storage__heading">
        What we store on your device
      </h2>
      <p className="ad-storage__intro">
        Everything below is needed for the site to work or to remember your choices. We use no advertising and no
        tracking from other companies.
      </p>
      <div className="ad-storage__scroll">
        <table className="ad-storage__table">
          <caption className="ad-sr-only">What is stored on your device</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">What it does</th>
              <th scope="col">Kept</th>
              <th scope="col">Type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <th scope="row" className="ad-storage__name">
                  {item.name}
                </th>
                <td>{item.purpose}</td>
                <td>{item.kept}</td>
                <td>
                  <Badge variant={item.type === 'necessary' ? 'info' : 'neutral'}>
                    {item.type === 'necessary' ? 'Necessary' : 'Functional'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
