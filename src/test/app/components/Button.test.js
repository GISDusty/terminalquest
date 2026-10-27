import fs from 'fs';
import path from 'path';
import React, { useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import Button from '../../../js/app/components/Button';

test('Button component', () => {
  const { container } = render(<Button>Testing!</Button>);
  expect(container.firstChild.classList.contains('Button')).toBe(true);
});

// React lives in public/node_modules, while @testing-library/react lives in
// the root node_modules. A second copy of React at the root would make hooks
// fail with "Invalid hook call", so guard against it.
describe('single React copy', () => {
  const root = path.resolve(__dirname, '..', '..', '..', '..');

  test('root node_modules has no react or react-dom', () => {
    expect(fs.existsSync(path.join(root, 'node_modules', 'react'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'node_modules', 'react-dom'))).toBe(
      false
    );
  });

  test('RTL renders hook components with the app React', () => {
    function Counter() {
      const [n, setN] = useState(0);
      return <button onClick={() => setN(n + 1)}>{n}</button>;
    }
    const { container } = render(<Counter />);
    fireEvent.click(container.firstChild);
    expect(container.firstChild.textContent).toBe('1');
  });
});
