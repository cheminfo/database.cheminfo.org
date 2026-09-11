import { Callout, HTMLTable, Tag } from '@blueprintjs/core';
import type { ReactElement } from 'react';

import type {
  CompoundDetail as Compound,
  IrSpectrum,
  Listing,
  NmrSpectrum,
  PropertyClaim,
} from '../data/readCompound.ts';

import { SpectrumChart } from './SpectrumChart.tsx';

/** The two IR peak lists, told apart by colour wherever they are drawn. */
const IR_LEGEND = [
  {
    kind: 'reported',
    label: 'reported by the supplier',
    color: 'var(--brand-alt)',
  },
  { kind: 'picked', label: 'picked at build time', color: 'var(--brand)' },
];

const NMR_LEGEND = [{ kind: 'signal', label: 'signal', color: 'var(--brand)' }];

/**
 * The window a proton spectrum is drawn over — the same one the ranges were
 * picked in at build time. Outside it there is only noise and the water line.
 */
const NMR_WINDOW = { from: -0.5, to: 12 };

/**
 * One compound, and every row that points at it.
 *
 * Laid out to make the shape of the data visible rather than to be pretty: a
 * property sits under the listing that claims it, and a coupling sits under
 * its signal, under its range, under its spectrum.
 * @param props - The compound to show.
 * @param props.compound - The compound.
 * @returns The detail panel.
 */
export function CompoundDetail({
  compound,
}: {
  compound: Compound;
}): ReactElement {
  return (
    <article className="detail">
      <header className="detail__head">
        <h2 className="detail__name">{compound.name ?? compound.smiles}</h2>
        <Tag minimal size="large">
          {compound.formula}
        </Tag>
        {compound.cas.map((cas) => (
          <Tag key={cas} minimal intent="primary">
            CAS {cas}
          </Tag>
        ))}
      </header>

      <dl className="detail__facts">
        <Fact label="Molecular weight" value={format(compound.mass, 4)} />
        <Fact
          label="Monoisotopic"
          value={format(compound.monoisotopicMass, 6)}
        />
        <Fact label="Charge" value={String(compound.charge)} />
        <Fact label="Unsaturation" value={format(compound.unsaturation, 1)} />
        <Fact
          label="Atoms"
          value={compound.nbAtoms === null ? '—' : String(compound.nbAtoms)}
        />
        <Fact
          label="Suppliers"
          value={
            compound.nbSuppliers === null ? '—' : String(compound.nbSuppliers)
          }
        />
        <Fact label="SMILES" value={compound.smiles} mono />
        <Fact label="OCL id code" value={compound.idCode} mono />
        <Fact
          label="Elements"
          value={compound.elements
            .map((e) => `${e.symbol}${e.count}`)
            .join(' ')}
          mono
        />
      </dl>

      <Section title={`Names (${compound.names.length})`}>
        <div className="detail__names">
          {compound.names.map((name) => (
            <span
              key={`${name.language}-${name.value}`}
              className="detail__name-chip"
            >
              <Tag minimal>{name.language}</Tag> {name.value}
            </span>
          ))}
        </div>
      </Section>

      <Section title={`Catalogue listings (${compound.listings.length})`}>
        <p className="detail__hint">
          A melting or boiling point is this listing&rsquo;s claim, which is why
          the same compound can carry several.
        </p>
        {compound.listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </Section>

      {compound.ir.length > 0 ? (
        <Section title={`Infrared (${compound.ir.length})`}>
          {compound.ir.map((spectrum) => (
            <IrCard key={spectrum.id} spectrum={spectrum} />
          ))}
        </Section>
      ) : null}

      {compound.nmr.length > 0 ? (
        <Section title={`¹H NMR (${compound.nmr.length})`}>
          {compound.nmr.map((spectrum) => (
            <NmrCard key={spectrum.id} spectrum={spectrum} />
          ))}
        </Section>
      ) : null}

      {compound.ir.length === 0 && compound.nmr.length === 0 ? (
        <Callout className="detail__nospectra">
          No spectrum was harvested for this compound. 171 of the 541 carry an
          IR spectrum and 50 a proton spectrum.
        </Callout>
      ) : null}
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <section className="detail__section">
      <h3 className="detail__section-title">{title}</h3>
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactElement {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'is-mono' : undefined}>{value}</dd>
    </>
  );
}

function ListingCard({ listing }: { listing: Listing }): ReactElement {
  return (
    <div className="detail__listing">
      <header>
        <Tag minimal>{listing.supplier ?? 'unknown supplier'}</Tag>
        <span className="detail__listing-id">entry {listing.entryId}</span>
        {listing.catalogId ? (
          <span className="detail__listing-id">
            catalogue {listing.catalogId}
          </span>
        ) : null}
        {listing.purity ? (
          <Tag minimal intent="success">
            {listing.purity}
          </Tag>
        ) : null}
      </header>
      {listing.description ? (
        <p className="detail__listing-desc">{listing.description}</p>
      ) : null}
      <div className="detail__claims">
        <Claims
          label="Melting point"
          unit="°C"
          claims={listing.meltingPoints}
        />
        <Claims
          label="Boiling point"
          unit="°C"
          claims={listing.boilingPoints}
        />
        <Claims label="Density" unit="" claims={listing.densities} />
        <Claims label="Flash point" unit="°C" claims={listing.flashPoints} />
      </div>
      {listing.hazards.length > 0 ? (
        <details className="detail__hazards">
          <summary>{listing.hazards.length} hazard statements</summary>
          <ul>
            {listing.hazards.map((hazard) => (
              <li key={hazard.id}>
                <Tag minimal>{hazard.system}</Tag> <code>{hazard.code}</code>{' '}
                {hazard.description}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Claims({
  label,
  unit,
  claims,
}: {
  label: string;
  unit: string;
  claims: PropertyClaim[];
}): ReactElement | null {
  if (claims.length === 0) return null;
  return (
    <div className="detail__claim">
      <span className="detail__claim-label">{label}</span>
      {claims.map((claim) => (
        <span
          key={`${claim.low}-${claim.high}-${claim.pressure}-${claim.temperature}`}
        >
          {claim.low === null ? '?' : claim.low}
          {claim.high === null || claim.high === claim.low
            ? ''
            : `–${claim.high}`}
          {unit}
          {claim.pressure ? ` at ${claim.pressure} mmHg` : ''}
          {claim.temperature ? ` at ${claim.temperature} °C` : ''}
        </span>
      ))}
    </div>
  );
}

function IrCard({ spectrum }: { spectrum: IrSpectrum }): ReactElement {
  const reported = spectrum.peaks.filter((peak) => peak.source === 'reported');
  const picked = spectrum.peaks.filter((peak) => peak.source === 'picked');
  return (
    <div className="detail__spectrum">
      <header>
        <span className="detail__listing-id">source {spectrum.sourceId}</span>
        <Tag minimal>{reported.length} reported</Tag>
        <Tag minimal>{picked.length} picked</Tag>
        {spectrum.solvent ? <Tag minimal>{spectrum.solvent}</Tag> : null}
      </header>
      <SpectrumChart
        jcamp={spectrum.jcamp}
        legend={IR_LEGEND}
        markers={spectrum.peaks.map((peak) => ({
          x: peak.wavenumber,
          kind: peak.source,
        }))}
      />
      <details className="detail__peaks">
        <summary>The band lists, side by side</summary>
        <HTMLTable compact striped>
          <thead>
            <tr>
              <th>cm⁻¹</th>
              <th>%T</th>
              <th>A</th>
              <th>from</th>
            </tr>
          </thead>
          <tbody>
            {spectrum.peaks.map((peak) => (
              <tr key={`${peak.source}-${peak.wavenumber}`}>
                <td className="is-mono">{peak.wavenumber.toFixed(2)}</td>
                <td className="is-mono">{format(peak.transmittance, 2)}</td>
                <td className="is-mono">{format(peak.absorbance, 4)}</td>
                <td>{peak.source}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </details>
    </div>
  );
}

function NmrCard({ spectrum }: { spectrum: NmrSpectrum }): ReactElement {
  return (
    <div className="detail__spectrum">
      <header>
        <span className="detail__listing-id">source {spectrum.sourceId}</span>
        <Tag minimal>{spectrum.nucleus}</Tag>
        {spectrum.solvent ? <Tag minimal>{spectrum.solvent}</Tag> : null}
        <Tag minimal>{spectrum.frequency?.toFixed(1)} MHz</Tag>
        <Tag minimal>{spectrum.pulseSequence}</Tag>
        <Tag minimal>{spectrum.ranges.length} ranges</Tag>
      </header>
      <SpectrumChart
        jcamp={spectrum.jcamp}
        legend={NMR_LEGEND}
        window={NMR_WINDOW}
        bands={spectrum.ranges.map((range) => ({
          from: range.from,
          to: range.to,
        }))}
        markers={spectrum.ranges.flatMap((range) =>
          range.signals.map((signal) => ({ x: signal.delta, kind: 'signal' })),
        )}
      />
      <table className="detail__ranges">
        <thead>
          <tr>
            <th>range (ppm)</th>
            <th>∫</th>
            <th>δ</th>
            <th>mult.</th>
            <th>J (Hz)</th>
          </tr>
        </thead>
        <tbody>
          {spectrum.ranges.map((range) =>
            range.signals.length === 0 ? (
              <tr key={range.id}>
                <td className="is-mono">
                  {range.from.toFixed(3)}–{range.to.toFixed(3)}
                </td>
                <td className="is-mono">{format(range.integration, 2)}</td>
                <td colSpan={3}>no signal compiled</td>
              </tr>
            ) : (
              range.signals.map((signal, index) => (
                <tr key={signal.id}>
                  {index === 0 ? (
                    <>
                      <td className="is-mono" rowSpan={range.signals.length}>
                        {range.from.toFixed(3)}–{range.to.toFixed(3)}
                      </td>
                      <td className="is-mono" rowSpan={range.signals.length}>
                        {format(range.integration, 2)}
                      </td>
                    </>
                  ) : null}
                  <td className="is-mono">{signal.delta.toFixed(4)}</td>
                  <td>{signal.multiplicity ?? '—'}</td>
                  <td className="is-mono">
                    {signal.couplings.length === 0
                      ? '—'
                      : signal.couplings
                          .map((c) => c.coupling.toFixed(2))
                          .join(', ')}
                  </td>
                </tr>
              ))
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function format(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits);
}
