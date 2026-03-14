// Client-side error handling
export function handleError({ error, event }: { error: any; event: any }) {
  console.error('Client error:', error);
  return {
    message: 'An error occurred',
    code: error?.code ?? 'UNKNOWN'
  };
}
