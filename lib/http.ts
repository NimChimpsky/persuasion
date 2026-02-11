export function redirect(req: Request, path: string, status = 303): Response {
  return Response.redirect(new URL(path, req.url), status);
}
