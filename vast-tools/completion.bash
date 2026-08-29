_vast_completion() {
  local current previous command service_action
  current="${COMP_WORDS[COMP_CWORD]}"
  previous="${COMP_WORDS[COMP_CWORD-1]}"
  command="${COMP_WORDS[1]}"

  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "test t services svc ps completion help" -- "${current}"))
    return
  fi

  case "${command}" in
    services|svc)
      if [[ ${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=($(compgen -W "list start stop restart" -- "${current}"))
        return
      fi

      service_action="${COMP_WORDS[2]}"
      case "${service_action}" in
        start)
          if [[ "${current}" == -* ]]; then
            COMPREPLY=($(compgen -W "--skip-build -sb --help -h" -- "${current}"))
          else
            COMPREPLY=($(compgen -W "postgres tor-proxy vast-api wiremock vast-portal" -- "${current}"))
          fi
          return
          ;;
        restart)
          if [[ "${current}" == -* ]]; then
            COMPREPLY=($(compgen -W "--skip-build -sb --clean-db --help -h" -- "${current}"))
          else
            COMPREPLY=($(compgen -W "postgres tor-proxy vast-api wiremock vast-portal" -- "${current}"))
          fi
          return
          ;;
        list|stop)
          if [[ "${current}" == -* ]]; then
            COMPREPLY=($(compgen -W "--help -h" -- "${current}"))
          else
            COMPREPLY=($(compgen -W "postgres tor-proxy vast-api wiremock vast-portal" -- "${current}"))
          fi
          return
          ;;
      esac
      ;;
    ps)
      if [[ "${current}" == -* ]]; then
        COMPREPLY=($(compgen -W "--help -h" -- "${current}"))
      else
        COMPREPLY=($(compgen -W "postgres tor-proxy vast-api wiremock vast-portal" -- "${current}"))
      fi
      return
      ;;
    completion|help)
      COMPREPLY=()
      return
      ;;
    test|t)
      if [[ "${current}" == -* ]]; then
        COMPREPLY=($(compgen -W "--build -b --help -h" -- "${current}"))
      else
        COMPREPLY=()
      fi
      return
      ;;
  esac

  COMPREPLY=($(compgen -W "test t services svc ps completion help" -- "${current}"))
}

complete -F _vast_completion vast
export VAST_COMPLETION_LOADED=1
