import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('exposes a default status label to assistive technology', () => {
    render(<Spinner />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('uses a caller-supplied label', () => {
    render(<Spinner label="Fetching characters" />);

    expect(screen.getByRole('status')).toHaveTextContent('Fetching characters');
  });
});
