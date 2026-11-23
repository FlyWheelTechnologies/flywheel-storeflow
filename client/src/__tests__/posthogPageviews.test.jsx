import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import posthog from 'posthog-js';
import { initPostHog } from '../services/posthogService';

const pageviews = [];
let initialPageviews = [];

const Page = ({ name }) => {
  const navigate = useNavigate();
  return (
    <div>
      <h1>{name}</h1>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/products">Products</Link>
      <Link to="/sales">Sales</Link>
      <button onClick={() => navigate('/products', { replace: true })}>Replace products</button>
      <button onClick={() => navigate('/products?category=drinks')}>Filter products</button>
    </div>
  );
};

const TestApp = () => (
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Page name="dashboard page" />} />
        <Route path="/products" element={<Page name="products page" />} />
        <Route path="/sales" element={<Page name="sales page" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

const goTo = async (linkName) => {
  fireEvent.click(screen.getByRole('link', { name: linkName }));
  await flush();
};

describe('PostHog route pageviews', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    vi.spyOn(posthog, 'capture').mockImplementation((event) => {
      if (event === '$pageview') pageviews.push(window.location.pathname + window.location.search);
    });
    window.history.replaceState(null, '', '/dashboard');
    initPostHog();
    await flush();
    initialPageviews = [...pageviews];
  });

  beforeEach(async () => {
    window.history.replaceState(null, '', '/dashboard');
    await flush();
    pageviews.length = 0;
    render(<TestApp />);
  });

  afterEach(() => cleanup());

  it('captures one pageview for the initial page load', async () => {
    await flush();
    expect(initialPageviews).toEqual(['/dashboard']);
    expect(pageviews).toEqual([]);
  });

  it('captures one pageview for each client-side route change', async () => {
    await goTo('Products');
    await goTo('Sales');
    await goTo('Dashboard');

    expect(pageviews).toEqual(['/products', '/sales', '/dashboard']);
  });

  it('captures a pageview for browser back and forward navigation', async () => {
    await goTo('Products');
    await goTo('Sales');
    pageviews.length = 0;

    await act(async () => window.history.back());
    await flush();
    await act(async () => window.history.forward());
    await flush();

    expect(pageviews).toEqual(['/products', '/sales']);
  });

  it('does not capture a duplicate pageview when the path does not change', async () => {
    await goTo('Products');
    await goTo('Products');
    fireEvent.click(screen.getByRole('button', { name: 'Replace products' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Filter products' }));
    await flush();

    expect(pageviews).toEqual(['/products']);
  });
});
