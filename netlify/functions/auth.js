exports.handler = async () => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  const redirectUri = "https://solarcitycuba.netlify.app/.netlify/functions/auth-callback";

  return {
    statusCode: 302,
    headers: {
      Location:
        "https://github.com/login/oauth/authorize" +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        "&scope=repo,user",
    },
  };
};
