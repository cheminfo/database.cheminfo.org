import { Callout, HTMLTable, Tag } from '@blueprintjs/core';
import type { ReactElement } from 'react';
import { ClickToCopy } from 'react-cheminfo/ui';
import { MF } from 'react-mf';

import type {
  CompoundDetail as Compound,
  HazardStatement,
  IrSpectrum,
  Listing,
  NmrCoupling,
  NmrRange,
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
        <h2 className="detail__name">
          <ClickToCopy
            value={compound.name ?? compound.smiles}
            label={compound.name === null ? 'SMILES' : 'name'}
            disabled={(compound.name ?? compound.smiles) === ''}
          >
            {compound.name ?? compound.smiles}
          </ClickToCopy>
        </h2>
        {/* A `Tag` clips whatever overflows it, so the copy target wraps the
            tag rather than sitting inside it. */}
        <ClickToCopy
          as="div"
          className="detail__copy-tag"
          value={compound.formula}
          label="molecular formula"
        >
          <Tag minimal size="large">
            <MF mf={compound.formula} />
          </Tag>
        </ClickToCopy>
        {compound.cas.map((cas) => (
          <ClickToCopy
            key={cas}
            as="div"
            className="detail__copy-tag"
            value={cas}
            label="CAS number"
          >
            <Tag minimal intent="primary">
              CAS {cas}
            </Tag>
          </ClickToCopy>
        ))}
      </header>

      <dl className="detail__facts">
        <Fact
          label="Molecular weight"
          value={format(compound.mass, 4)}
          copyAs="molecular weight"
        />
        <Fact
          label="Monoisotopic"
          value={format(compound.monoisotopicMass, 6)}
          copyAs="monoisotopic mass"
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
        <Fact label="SMILES" value={compound.smiles} mono copyAs="SMILES" />
        <Fact
          label="OCL id code"
          value={compound.idCode}
          mono
          copyAs="ID code"
        />
      </dl>

      <Section title={`Names (${compound.names.length})`}>
        <div className="detail__names">
          {compound.names.map((name) => (
            <span
              key={`${name.language}-${name.value}`}
              className="detail__name-chip"
            >
              <Tag minimal>{name.language}</Tag>{' '}
              <ClickToCopy value={name.value} label="name">
                {name.value}
              </ClickToCopy>
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
  copyAs,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /** What the value is called on the clipboard; left out when it is not copied. */
  copyAs?: string;
}): ReactElement {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'is-mono' : undefined}>
        {copyAs === undefined ? (
          value
        ) : (
          <ClickToCopy
            as="div"
            value={value}
            label={copyAs}
            disabled={value === '' || value === '—'}
          >
            {value}
          </ClickToCopy>
        )}
      </dd>
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
            catalogue{' '}
            <ClickToCopy value={listing.catalogId} label="catalogue number">
              {listing.catalogId}
            </ClickToCopy>
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
                <Tag minimal>{hazard.system}</Tag>{' '}
                <ClickToCopy
                  value={hazardStatement(hazard)}
                  label="hazard statement"
                  disabled={hazardStatement(hazard) === ''}
                >
                  <code>{hazard.code}</code> {hazard.description}
                </ClickToCopy>
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
        <ClickToCopy
          key={`${claim.low}-${claim.high}-${claim.pressure}-${claim.temperature}`}
          value={claimNumber(claim)}
          label={label.toLowerCase()}
          disabled={claim.low === null && claim.high === null}
        >
          {claimNumber(claim)}
          {unit}
          {claim.pressure ? ` at ${claim.pressure} mmHg` : ''}
          {claim.temperature ? ` at ${claim.temperature} °C` : ''}
        </ClickToCopy>
      ))}
    </div>
  );
}

/** The bare number or range of a claim — what is pasted, without its unit. */
function claimNumber(claim: PropertyClaim): string {
  const low = claim.low === null ? '?' : String(claim.low);
  if (claim.high === null || claim.high === claim.low) return low;
  return `${low}–${claim.high}`;
}

/** The code and the text of a hazard statement, as safety paperwork wants it. */
function hazardStatement(hazard: HazardStatement): string {
  return [hazard.code, hazard.description].filter(Boolean).join(' ');
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
                <NumberCell
                  value={peak.wavenumber.toFixed(2)}
                  label="wavenumber"
                />
                <NumberCell
                  value={format(peak.transmittance, 2)}
                  label="transmittance"
                />
                <NumberCell
                  value={format(peak.absorbance, 4)}
                  label="absorbance"
                />
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
                <NumberCell value={rangeText(range)} label="range" />
                <NumberCell
                  value={format(range.integration, 2)}
                  label="integration"
                />
                <td colSpan={3}>no signal compiled</td>
              </tr>
            ) : (
              range.signals.map((signal, index) => (
                <tr key={signal.id}>
                  {index === 0 ? (
                    <>
                      {/* A spanning cell holds its target instead of being
                          one, because `ClickToCopy` passes no `rowSpan`. */}
                      <td className="is-mono" rowSpan={range.signals.length}>
                        <ClickToCopy
                          as="div"
                          value={rangeText(range)}
                          label="range"
                        >
                          {rangeText(range)}
                        </ClickToCopy>
                      </td>
                      <td className="is-mono" rowSpan={range.signals.length}>
                        <ClickToCopy
                          as="div"
                          value={format(range.integration, 2)}
                          label="integration"
                          disabled={range.integration === null}
                        >
                          {format(range.integration, 2)}
                        </ClickToCopy>
                      </td>
                    </>
                  ) : null}
                  <NumberCell
                    value={signal.delta.toFixed(4)}
                    label="chemical shift"
                  />
                  <td>{signal.multiplicity ?? '—'}</td>
                  <NumberCell
                    value={couplingText(signal.couplings)}
                    label="coupling constants"
                  />
                </tr>
              ))
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

/** A monospaced peak-list cell, copied on its own so a value can be pasted. */
function NumberCell({
  value,
  label,
}: {
  value: string;
  label: string;
}): ReactElement {
  return (
    <ClickToCopy
      as="td"
      className="is-mono"
      value={value}
      label={label}
      disabled={value === '—'}
    >
      {value}
    </ClickToCopy>
  );
}

function rangeText(range: NmrRange): string {
  return `${range.from.toFixed(3)}–${range.to.toFixed(3)}`;
}

function couplingText(couplings: NmrCoupling[]): string {
  if (couplings.length === 0) return '—';
  const values: string[] = [];
  for (const coupling of couplings) values.push(coupling.coupling.toFixed(2));
  return values.join(', ');
}

function format(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits);
}
