export type OptimisticArgs = {
  onLocalChange: () => void
  onLocalRollback: () => void
  mutation: () => Promise<Response>
  errorMessage: string
  shouldApply?: () => boolean
  onError?: (msg: string) => void
}

export async function optimisticMutate(args: OptimisticArgs): Promise<boolean> {
  args.onLocalChange()
  const apply = args.shouldApply ?? (() => true)
  const handleFailure = () => {
    if (!apply()) return
    args.onLocalRollback()
    if (args.onError) args.onError(args.errorMessage)
    else alert(args.errorMessage)
  }
  try {
    const res = await args.mutation()
    if (!res.ok) {
      handleFailure()
      return false
    }
    return true
  } catch {
    handleFailure()
    return false
  }
}
