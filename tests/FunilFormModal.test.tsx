// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FunilFormModal } from '../src/components/FunilFormModal';

describe('FunilFormModal', () => {
  it('renders the new-record form and required business fields', () => {
    render(
      <FunilFormModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        regionais={[]}
        editingFunil={null}
      />,
    );

    expect(screen.getByText('Novo Registro')).toBeInTheDocument();
    expect(screen.getByText('Dados do Negócio')).toBeInTheDocument();
    expect(screen.getByText('Responsável *')).toBeInTheDocument();
    expect(screen.getByText('Negócio *')).toBeInTheDocument();
  });
});
