export const POST = async (request: Request) =>
  new Response(
    JSON.stringify({
      status: 'success',
      message:
        'Log import endpoint exists but is not fully implemented in this demo',
    }),
    {
      status: 200,
    },
  );
