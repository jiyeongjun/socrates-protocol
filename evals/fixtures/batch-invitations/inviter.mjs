export function createInviter(send) {
  const sent = [];
  return {
    sent,
    async invite(email) {
      await send(email);
      sent.push(email);
      return { email, status: "sent" };
    },
  };
}
