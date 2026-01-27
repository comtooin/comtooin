import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders main title', () => {
  render(<App />);
  const titleElement = screen.getByText(/COMTOOIN Maintenance Services/i);
  expect(titleElement).toBeInTheDocument();
});
